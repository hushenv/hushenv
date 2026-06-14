export class NotInitializedError extends Error {
  constructor(message = 'hushenv is not initialised. Run `hushenv init` first.') {
    super(message);
    this.name = 'NotInitializedError';
  }
}

export class SecretNotFoundError extends Error {
  constructor(public readonly secretName: string) {
    super(
      `Secret "${secretName}" not found in the vault. Add it with: hushenv set ${secretName}`,
    );
    this.name = 'SecretNotFoundError';
  }
}

export class KeychainUnavailableError extends Error {
  constructor(
    message: string,
    public readonly fallbackKey: string,
  ) {
    super(message);
    this.name = 'KeychainUnavailableError';
  }
}
