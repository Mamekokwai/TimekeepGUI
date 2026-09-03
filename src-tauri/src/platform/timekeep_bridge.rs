use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, AsyncWriteExt, BufReader};
use tokio::time::timeout;

#[cfg(target_os = "windows")]
const TIMEKEEP_PIPE_PATH: &str = r"\\.\pipe\Timekeep";
#[cfg(unix)]
const TIMEKEEP_SOCKET_PATH: &str = "/var/run/timekeep/timekeep.sock";
const TIMEKEEP_REQUEST_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct TimekeepRequest {
    pub request_id: String,
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub all: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<Value>,
}

pub async fn request(request: TimekeepRequest) -> Result<Value, String> {
    timeout(TIMEKEEP_REQUEST_TIMEOUT, send_request(request))
        .await
        .map_err(|_| "Timekeep service request timed out".to_string())?
        .map_err(|error| format!("Timekeep service is unavailable: {error}"))
}

#[cfg(target_os = "windows")]
async fn send_request(request: TimekeepRequest) -> Result<Value, String> {
    use tokio::net::windows::named_pipe::ClientOptions;

    let stream = ClientOptions::new()
        .read(true)
        .write(true)
        .open(TIMEKEEP_PIPE_PATH)
        .map_err(|error| error.to_string())?;
    send_json(stream, request).await
}

#[cfg(unix)]
async fn send_request(request: TimekeepRequest) -> Result<Value, String> {
    let stream = tokio::net::UnixStream::connect(TIMEKEEP_SOCKET_PATH)
        .await
        .map_err(|error| error.to_string())?;
    send_json(stream, request).await
}

#[cfg(not(any(target_os = "windows", unix)))]
async fn send_request(_request: TimekeepRequest) -> Result<Value, String> {
    Err("Timekeep IPC is not supported on this platform".to_string())
}

async fn send_json<S>(mut stream: S, request: TimekeepRequest) -> Result<Value, String>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    let mut payload = serde_json::to_vec(&request).map_err(|error| error.to_string())?;
    payload.push(b'\n');
    stream
        .write_all(&payload)
        .await
        .map_err(|error| error.to_string())?;
    stream.flush().await.map_err(|error| error.to_string())?;

    let mut response_line = String::new();
    BufReader::new(stream)
        .read_line(&mut response_line)
        .await
        .map_err(|error| error.to_string())?;
    if response_line.trim().is_empty() {
        return Err("Timekeep service returned an empty response".to_string());
    }

    serde_json::from_str(response_line.trim()).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{duplex, AsyncBufReadExt, AsyncWriteExt};

    #[tokio::test]
    async fn send_json_round_trips_a_structured_response() {
        let (client, server) = duplex(4096);
        let server_task = tokio::spawn(async move {
            let mut reader = BufReader::new(server);
            let mut request_line = String::new();
            reader.read_line(&mut request_line).await.unwrap();
            let request: TimekeepRequest = serde_json::from_str(request_line.trim()).unwrap();
            assert_eq!(request.request_id, "rust-test-request");
            assert_eq!(request.action, "service_status");

            let mut server = reader.into_inner();
            server
                .write_all(
                    br#"{"request_id":"rust-test-request","ok":true,"data":{"running":true}}"#,
                )
                .await
                .unwrap();
            server.write_all(b"\n").await.unwrap();
        });

        let response = send_json(
            client,
            TimekeepRequest {
                request_id: "rust-test-request".to_string(),
                action: "service_status".to_string(),
                name: None,
                pid: None,
                category: None,
                project: None,
                date: None,
                start: None,
                end: None,
                limit: None,
                all: None,
                config: None,
            },
        )
        .await
        .unwrap();

        assert_eq!(response["ok"], true);
        assert_eq!(response["data"]["running"], true);
        server_task.await.unwrap();
    }
}
