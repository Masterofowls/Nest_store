import { Test } from '@nestjs/testing';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { ForbiddenException } from '@nestjs/common';
import { WriteOriginGuard } from './write-origin.guard';
import { AuthService } from '../auth.service';

describe('WriteOriginGuard', () => {
  let guard: WriteOriginGuard;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WriteOriginGuard,
        {
          provide: AuthService,
          useValue: { auth: { options: { baseURL: 'http://localhost:3000' } } },
        },
      ],
    }).compile();
    guard = module.get(WriteOriginGuard);
  });

  it('accepts only the configured origin', () => {
    expect(
      guard.canActivate(
        new ExecutionContextHost([
          { headers: { origin: 'http://localhost:3000' } },
        ]),
      ),
    ).toBe(true);
  });

  it.each([
    undefined,
    'null',
    'https://attacker.example',
    'http://localhost:3000.attacker.example',
    'http://localhost:3000/',
  ])('rejects missing or untrusted origin %s', (origin) => {
    expect(() =>
      guard.canActivate(new ExecutionContextHost([{ headers: { origin } }])),
    ).toThrow(ForbiddenException);
  });
});
