import { RiotGateway } from '../riot-gateway/index.js';
import { riotRoutingSummary } from './hosts.js';

export function initRiotGateway(): void {
  RiotGateway.getInstance();
}

export async function shutdownRiotGateway(): Promise<void> {
  await RiotGateway.resetInstance();
}

export function logRiotRoutingVerified(): void {
  console.log(`[riot] routing verified ${riotRoutingSummary()}`);
}
