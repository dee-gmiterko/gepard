export interface InstanceLauncher {
  launch(target: string | null): Promise<void>;
}
