import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Testes E2E de smoke — verificam respostas HTTP sem banco real.
 * Para testes completos: docker-compose up -d && npx prisma migrate dev
 */
describe('API E2E — Smoke Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Health check básico ──────────────────────────────────────────────────

  it('GET / deve retornar 200', () => {
    return request(app.getHttpServer()).get('/').expect(200);
  });

  // ─── Validação de DTOs ────────────────────────────────────────────────────

  it('POST /api/v1/companies/register — 400 para body vazio', () => {
    return request(app.getHttpServer())
      .post('/api/v1/companies/register')
      .send({})
      .expect(400);
  });

  it('POST /api/v1/companies/register — 400 para CNPJ mal formatado', () => {
    return request(app.getHttpServer())
      .post('/api/v1/companies/register')
      .send({
        email: 'teste@empresa.com',
        ownerName: 'João',
        cnpj: '123',
        ownerBirthDate: '1980-01-01',
        allowOvertime: false,
        maxEmployees: 10,
        password: 'SenhaForte@123',
      })
      .expect(400);
  });

  it('POST /api/v1/companies/login — 400 para body vazio', () => {
    return request(app.getHttpServer())
      .post('/api/v1/companies/login')
      .send({})
      .expect(400);
  });

  it('POST /api/v1/employees/login — 400 para body vazio', () => {
    return request(app.getHttpServer())
      .post('/api/v1/employees/login')
      .send({})
      .expect(400);
  });

  // ─── Guards de autenticação ───────────────────────────────────────────────

  it('GET /api/v1/dashboard — 401 sem token', () => {
    return request(app.getHttpServer())
      .get('/api/v1/dashboard')
      .expect(401);
  });

  it('POST /api/v1/attendance/check-in — 401 sem token', () => {
    return request(app.getHttpServer())
      .post('/api/v1/attendance/check-in')
      .expect(401);
  });

  it('GET /api/v1/companies/me — 401 sem token', () => {
    return request(app.getHttpServer())
      .get('/api/v1/companies/me')
      .expect(401);
  });

  it('GET /api/v1/employees — 401 sem token', () => {
    return request(app.getHttpServer())
      .get('/api/v1/employees')
      .expect(401);
  });

  it('GET /api/v1/roles — 401 sem token', () => {
    return request(app.getHttpServer())
      .get('/api/v1/roles')
      .expect(401);
  });
});
