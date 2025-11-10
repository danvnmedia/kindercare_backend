import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { ClerkClientProvider } from './clerk-client.provider';

@Module({
  providers: [
    ClerkClientProvider,
    IdentityService,
  ],
  exports: [
    IdentityService,
  ],
})
export class ClerkModule {}
