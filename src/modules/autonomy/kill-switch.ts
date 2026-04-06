export interface KillSwitchState {
  globalAutonomyEnabled: boolean;
  sellerAutonomyEnabled: boolean;
}

export function assertAutonomyEnabled(state: KillSwitchState): void {
  if (!state.globalAutonomyEnabled) {
    throw new Error("Global autonomy kill switch is active");
  }

  if (!state.sellerAutonomyEnabled) {
    throw new Error("Seller autonomy is disabled");
  }
}
