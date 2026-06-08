/**
 * Force IPv4 for outbound connections (side-effect import).
 *
 * Some networks — mobile hotspots especially — advertise IPv6 but can't actually route
 * it. Node's "Happy Eyeballs" races IPv4 and IPv6 connections, so it intermittently picks
 * the dead IPv6 path and fails with an opaque "fetch failed", even though IPv4 works fine.
 * Pinning IPv4 first and disabling auto family selection makes outbound calls (Groq + the
 * Sepolia RPC) deterministic. Harmless on networks with working IPv4.
 */
import dns from "node:dns";
import net from "node:net";

dns.setDefaultResultOrder("ipv4first");
// Available on Node 19+; optional-call so older runtimes don't throw.
net.setDefaultAutoSelectFamily?.(false);
