// ULID utilities for generating unique identifiers using Web Crypto API

// Simple ULID-like implementation using Web Crypto API for Cloudflare Workers
export function generateULID(): string {
  // Generate timestamp part (first 10 characters)
  const timestamp = Date.now().toString(36).padStart(10, '0');
  
  // Generate random part (16 characters)
  const randomBytes = crypto.getRandomValues(new Uint8Array(10));
  const random = Array.from(randomBytes)
    .map(b => b.toString(36))
    .join('')
    .substring(0, 16)
    .padStart(16, '0');
  
  return (timestamp + random).toUpperCase();
}

export function generateSessionId(): string {
  return generateULID();
}

export function generateUserId(): string {
  return generateULID();
}

export function generateResumeToken(): string {
  return generateULID();
}

export function generateGoalId(): string {
  return generateULID();
}

export function generateMessageId(): string {
  return generateULID();
}