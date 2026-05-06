import { Global, Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationCronService } from './notification.cron';

@Global()
@Module({
  providers: [NotificationService, NotificationCronService],
  exports: [NotificationService],
})
export class NotificationModule {}
