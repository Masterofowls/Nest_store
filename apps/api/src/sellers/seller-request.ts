import type { SessionRequest } from '../auth/session-request';
import type { SellerProfile } from '../db/schema';
import { ForbiddenException } from '@nestjs/common';

export interface SellerRequest extends SessionRequest {
  sellerProfile?: SellerProfile;
}

export function requestSellerId(
  request: Pick<SellerRequest, 'sellerProfile'>,
): string {
  if (!request.sellerProfile) {
    throw new ForbiddenException('A seller profile is required');
  }
  return request.sellerProfile.id;
}
