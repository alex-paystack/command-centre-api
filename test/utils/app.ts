import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '~/app.module';
import { configureApp } from '~/app.setup';

export async function createTestApp(
  overrides?: (builder: TestingModuleBuilder) => void,
): Promise<INestApplication<App>> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (overrides) overrides(builder);

  const moduleFixture = await builder.compile();
  const app = moduleFixture.createNestApplication();

  configureApp(app);

  await app.init();
  return app;
}
