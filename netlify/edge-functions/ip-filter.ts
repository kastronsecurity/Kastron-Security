import type { Context } from "@netlify/edge-functions";

/**
 * Netlify Edge Function to filter access by IP address.
 * Reads allowed IPs from the ALLOWED_IPS environment variable.
 */
export default async (request: Request, context: Context) => {
  // Get the allowed IPs from environment variables
  // Netlify provides environment variables to Edge Functions
  const allowedIpsEnv = Netlify.env.get("ALLOWED_IPS");

  // If no allowed IPs are defined, allow all access (or you can change this to block all)
  if (!allowedIpsEnv) {
    console.warn("ALLOWED_IPS environment variable is not set. Access is currently unrestricted.");
    return;
  }

  // Parse the allowed IPs into an array
  const allowedIps = allowedIpsEnv.split(",").map((ip) => ip.trim());

  // Get the visitor's IP address
  // Netlify provides the client IP in the context
  const clientIp = context.ip;

  // Check if the client IP is in the allowed list
  if (clientIp && allowedIps.includes(clientIp)) {
    // IP is allowed, proceed to the next middleware or the site
    return;
  }

  // IP is not allowed, return a 403 Forbidden response
  console.log(`Access denied for IP: ${clientIp}`);
  
  return new Response("Forbidden: Your IP address is not authorized to access this site.", {
    status: 403,
    headers: {
      "Content-Type": "text/plain",
    },
  });
};

export const config = {
  path: "/*", // Run on all paths
};
