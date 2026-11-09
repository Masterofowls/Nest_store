import { Test } from '@nestjs/testing';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { ForbiddenException } from '@nestjs/common';
import { WriteOriginGuard } from './write-origin.guard';
import { AuthService } from '../auth.service';

describe('WriteOriginGuard', () => {
  let guard: WriteOriginGuard;
  let authService: {
    auth: { options: { baseURL: string | undefined } };
    trustedFrontendOrigin: string | undefined;
  };

  beforeEach(async () => {
    authService = {
      auth: { options: { baseURL: 'http://localhost:3000' } },
      trustedFrontendOrigin: undefined,
    };
    const module = await Test.createTestingModule({
      providers: [
        WriteOriginGuard,
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();
    guard = module.get(WriteOriginGuard);
  });

  it('accepts the Better Auth base origin', () => {
    expect(
      guard.canActivate(
        new ExecutionContextHost([
          { headers: { origin: 'http://localhost:3000' } },
        ]),
      ),
    ).toBe(true);
  });

  it('accepts the configured frontend origin', () => {
    authService.trustedFrontendOrigin = 'http://localhost:3001';
    expect(
      guard.canActivate(
        new ExecutionContextHost([
          { headers: { origin: 'http://localhost:3001' } },
        ]),
      ),
    ).toBe(true);
  });

  it('rejects the frontend origin when it is not configured', () => {
    expect(() =>
      guard.canActivate(
        new ExecutionContextHost([
          { headers: { origin: 'http://localhost:3001' } },
        ]),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects even a configured frontend origin when the base URL is missing', () => {
    authService.auth.options.baseURL = undefined;
    authService.trustedFrontendOrigin = 'http://localhost:3001';
    expect(() =>
      guard.canActivate(
        new ExecutionContextHost([
          { headers: { origin: 'http://localhost:3001' } },
        ]),
      ),
    ).toThrow(ForbiddenException);
  });

  it.each([
    undefined,
    '',
    'null',
    'https://attacker.example',
    'http://localhost:3000.attacker.example',
    'http://localhost:3000/',
    'https://localhost:3000',
    'http://localhost:3002',
    'http://localhost:3001.attacker.example',
    'http://localhost:3001/',
    'https://localhost:3001',
  ])('rejects missing or untrusted origin %s', (origin) => {
    authService.trustedFrontendOrigin = 'http://localhost:3001';
    expect(() =>
      guard.canActivate(new ExecutionContextHost([{ headers: { origin } }])),
    ).toThrow(ForbiddenException);
  });

  it('rejects a missing origin when no frontend origin is configured', () => {
    expect(() =>
      guard.canActivate(new ExecutionContextHost([{ headers: {} }])),
    ).toThrow(ForbiddenException);
  });
});
