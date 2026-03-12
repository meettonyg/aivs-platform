import { promisify } from 'util';
import { pbkdf2 as pbkdf2Callback, randomBytes, timingSafeEqual } from 'crypto';

const pbkdf2 = promisify(pbkdf2Callback);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await pbkdf2(password, salt, 100000, 64, 'sha512');
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedPasswordHash: string): Promise<boolean> {
  const [salt, storedHash] = storedPasswordHash.split(':');
  if (!salt || !storedHash) return false;

  const derivedKey = await pbkdf2(password, salt, 100000, 64, 'sha512');
  const storedHashBuffer = Buffer.from(storedHash, 'hex');

  if (derivedKey.length !== storedHashBuffer.length) return false;

  return timingSafeEqual(derivedKey, storedHashBuffer);
}
