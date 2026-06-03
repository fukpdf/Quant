import type { Request, Response, NextFunction } from "express";

/**
 * security-headers-middleware.ts — Security response headers.
 *
 * Applies OWASP-recommended security headers without requiring helmet.
 * Applied globally in app.ts before all route handlers.
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME-type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  // Enable XSS filter in older browsers
  res.setHeader("X-XSS-Protection", "1; mode=block");
  // Referrer policy — limit referrer data
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Permissions policy — disable unneeded browser features
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  // Content Security Policy — restrict resource loading
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';",
  );
  // HSTS — force HTTPS in production
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  // Remove Express fingerprint
  res.removeHeader("X-Powered-By");
  next();
}
