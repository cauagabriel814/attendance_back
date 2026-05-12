import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly prisma: PrismaService) {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.EMAIL_PORT ?? 587),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });
  }

  /** Envia um e-mail e registra o resultado no log de auditoria */
  private async send(options: {
    to: string;
    subject: string;
    html: string;
    recipientId: string;
    recipientType: 'EMPLOYEE' | 'COMPANY';
    notificationType: string;
  }) {
    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      await this.prisma.emailNotificationLog.create({
        data: {
          recipientId: options.recipientId,
          recipientType: options.recipientType as any,
          notificationType: options.notificationType as any,
          status: 'SENT',
        },
      });
    } catch (error) {
      this.logger.error(`Falha ao enviar e-mail para ${options.to}: ${error}`);
      try {
        await this.prisma.emailNotificationLog.create({
          data: {
            recipientId: options.recipientId,
            recipientType: options.recipientType as any,
            notificationType: options.notificationType as any,
            status: 'FAILED',
            errorMessage: String(error),
          },
        });
      } catch (logError) {
        this.logger.error(`Falha ao registrar log de notificação: ${logError}`);
      }
    }
  }

  /** E-mail de verificação (empresa ou funcionário) */
  async sendEmailVerification(
    email: string,
    name: string,
    token: string,
    type: 'employee' | 'company',
    recipientId: string,
  ) {
    const verifyUrl = `${process.env.FRONTEND_URL}/${type === 'company' ? 'empresa' : 'funcionario'}/verificar-email?token=${token}`;

    await this.send({
      to: email,
      subject: 'Confirme seu e-mail — Controle de Ponto',
      html: `
        <h2>Olá, ${name}!</h2>
        <p>Clique no botão abaixo para confirmar seu e-mail e ativar sua conta.</p>
        <a href="${verifyUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0;">
          Confirmar E-mail
        </a>
        <p>Este link expira em <strong>24 horas</strong>.</p>
        <p>Se você não solicitou este cadastro, ignore este e-mail.</p>
      `,
      recipientId,
      recipientType: type === 'company' ? 'COMPANY' : 'EMPLOYEE',
      notificationType: 'EMAIL_VERIFICATION',
    });
  }

  /** E-mail de boas-vindas ao funcionário cadastrado na empresa */
  async sendEmployeeWelcome(
    email: string,
    employeeName: string,
    companyName: string,
    token: string,
    employeeId: string,
  ) {
    const verifyUrl = `${process.env.FRONTEND_URL}/funcionario/verificar-email?token=${token}`;

    await this.send({
      to: email,
      subject: `Bem-vindo(a) à ${companyName} — Controle de Ponto`,
      html: `
        <h2>Olá, ${employeeName}!</h2>
        <p>Você foi cadastrado(a) na empresa <strong>${companyName}</strong> no sistema de Controle de Ponto.</p>
        <p>Clique no botão abaixo para confirmar seu e-mail e criar sua senha:</p>
        <a href="${verifyUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0;">
          Confirmar E-mail
        </a>
        <p>Este link expira em <strong>24 horas</strong>.</p>
      `,
      recipientId: employeeId,
      recipientType: 'EMPLOYEE',
      notificationType: 'EMPLOYEE_REGISTERED',
    });
  }

  /** Lembrete de entrada (enviado 10 min antes do horário) */
  async sendCheckInReminder(
    email: string,
    name: string,
    entryTime: string,
    employeeId: string,
  ) {
    await this.send({
      to: email,
      subject: 'Lembrete: Seu horário de entrada se aproxima!',
      html: `
        <h2>Olá, ${name}!</h2>
        <p>Seu horário de entrada é às <strong>${entryTime}</strong> — em <strong>10 minutos</strong>.</p>
        <p>Prepare-se para registrar sua presença no sistema.</p>
      `,
      recipientId: employeeId,
      recipientType: 'EMPLOYEE',
      notificationType: 'CHECK_IN_REMINDER',
    });
  }

  /** Lembrete de saída (enviado 10 min antes do horário) */
  async sendCheckOutReminder(
    email: string,
    name: string,
    exitTime: string,
    employeeId: string,
  ) {
    await this.send({
      to: email,
      subject: 'Lembrete: Seu horário de saída se aproxima!',
      html: `
        <h2>Olá, ${name}!</h2>
        <p>Seu horário de saída é às <strong>${exitTime}</strong> — em <strong>10 minutos</strong>.</p>
        <p>Não se esqueça de registrar sua saída no sistema.</p>
      `,
      recipientId: employeeId,
      recipientType: 'EMPLOYEE',
      notificationType: 'CHECK_OUT_REMINDER',
    });
  }

  /** Alerta: funcionário tentou fazer hora extra, mas não é permitido */
  async sendOvertimeAlert(
    email: string,
    name: string,
    exitTime: string,
    employeeId: string,
  ) {
    await this.send({
      to: email,
      subject: 'Atenção: Horas extras não permitidas',
      html: `
        <h2>Olá, ${name}!</h2>
        <p>Seu horário de trabalho encerrou às <strong>${exitTime}</strong>.</p>
        <p>⚠️ Sua empresa <strong>não autoriza horas extras</strong>. Por favor, registre sua saída agora.</p>
      `,
      recipientId: employeeId,
      recipientType: 'EMPLOYEE',
      notificationType: 'OVERTIME_ALERT',
    });
  }
}
