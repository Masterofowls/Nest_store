import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { sessionUserId } from '../auth/session-user-id';
import type { SellerRequest } from './seller-request';
import { SellersService } from './sellers.service';

@Injectable()
export class SellerGuard implements CanActivate {
  constructor(private readonly sellers: SellersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SellerRequest>();
    request.sellerProfile = await this.sellers.requireSeller(
      sessionUserId(request),
    );
    return true;
  }
}
