import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { AuthModule } from './auth/auth.module';
import { CompanyModule } from './company/company.module';
import { RolesModule } from './roles/roles.module';
import { EmployeeModule } from './employee/employee.module';
import { AttendanceModule } from './attendance/attendance.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationModule } from './notification/notification.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import appConfig from './config/app.config';

@Module({
  imports: [
    // ─── Configuração global de env vars ──────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: '.env',
    }),

    // ─── Rate limiting: 5 req/min por IP nos endpoints de auth ────
    ThrottlerModule.forRoot([
      {
        name: 'auth',
        ttl: 60_000,
        limit: 5,
      },
      {
        name: 'global',
        ttl: 60_000,
        limit: 100,
      },
    ]),

    // ─── Cron jobs ────────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ─── Módulos de infraestrutura ────────────────────────────────
    PrismaModule,
    CryptoModule,
    NotificationModule,

    // ─── Módulos de negócio ───────────────────────────────────────
    AuthModule,
    CompanyModule,
    RolesModule,
    EmployeeModule,
    AttendanceModule,
    DashboardModule,
  ],
  providers: [
    // Rate limiting global
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Handler global de exceções (não vaza stack trace em prod)
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
