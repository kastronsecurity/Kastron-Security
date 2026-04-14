import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getSeverityFromLevel(level: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (level >= 12) return 'CRITICAL';
  if (level >= 8) return 'HIGH';
  if (level >= 5) return 'MEDIUM';
  return 'LOW';
}
