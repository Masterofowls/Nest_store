import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import { AuthService } from './auth/auth.service';

export function configureApp(app: NestExpressApplication): void {
  const authService = app.get(AuthService);

  app
    .getHttpAdapter()
    .getInstance()
    .all('/api/auth/*splat', toNodeHandler(authService.auth));

  app.useBodyParser('json');
  app.useBodyParser('urlencoded', { extended: true });
}
