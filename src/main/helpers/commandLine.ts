export interface CommandLineSwitch {
  name: string;
  value?: string;
}

export interface SwitchOverride {
  switches: CommandLineSwitch[];
  unlessGiven?: string[];
}

export function hasSwitch(argv: readonly string[], name: string): boolean {
  return argv.some((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
}

export function switchOverrides(
  argv: readonly string[],
  overrides: readonly SwitchOverride[],
): CommandLineSwitch[] {
  return overrides
    .filter(({ unlessGiven = [] }) => !unlessGiven.some((name) => hasSwitch(argv, name)))
    .flatMap(({ switches }) => switches);
}
