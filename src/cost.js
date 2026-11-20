// Turns an edge into a routing cost. Pure.
// fromId is the node we leave from. 'shortest' ignores it, but uphill/downhill
// profiles added later need the direction, so keep the parameter.
export const PROFILES = ['shortest'];

export function edgeCost(edge, fromId, profile) {
  switch (profile) {
    case 'shortest':
      return edge.length_m;
    default:
      throw new Error(`Unknown routing profile: ${profile}`);
  }
}
