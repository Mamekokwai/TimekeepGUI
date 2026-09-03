import { invokeWithCommandError } from "./commandError.ts";

export function pickCustomAppIcon(exeName: string): Promise<string | null> {
  return invokeWithCommandError<string | null>("cmd_pick_custom_app_icon", { exeName });
}
