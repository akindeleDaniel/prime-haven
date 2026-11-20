const DEFAULT_PORT = 3001;

export interface Environment {
  port: number;
}

export function getEnvironment(): Environment {
  const portValue = process.env.PORT;

  if (!portValue) {
    return { port: DEFAULT_PORT };
  }

  const port = Number(portValue);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value "${portValue}". PORT must be an integer from 1 to 65535.`);
  }

  return { port };
}
