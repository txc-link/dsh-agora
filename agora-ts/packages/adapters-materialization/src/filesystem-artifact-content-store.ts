import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import type { ArtifactContentStorePort } from '@agora-ts/core';

export class FilesystemArtifactContentStore implements ArtifactContentStorePort {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = resolve(rootDir);
    mkdirSync(this.rootDir, { recursive: true });
  }

  put(sha256: string, bytes: Buffer): string {
    assertHash(sha256);
    const target = this.pathFor(sha256);
    if (!existsSync(target)) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes, { flag: 'wx' });
    }
    return `sha256:${sha256}`;
  }

  get(contentUri: string): Buffer {
    const match = /^sha256:([a-f0-9]{64})$/u.exec(contentUri);
    if (!match) throw new TypeError('unsupported artifact content URI');
    return readFileSync(this.pathFor(match[1]!));
  }

  private pathFor(sha256: string): string {
    assertHash(sha256);
    const target = resolve(join(this.rootDir, sha256.slice(0, 2), sha256.slice(2)));
    if (!target.startsWith(`${this.rootDir}${sep}`)) throw new Error('artifact path escaped content root');
    return target;
  }
}

function assertHash(value: string): void {
  if (!/^[a-f0-9]{64}$/u.test(value)) throw new TypeError('artifact SHA-256 is invalid');
}
