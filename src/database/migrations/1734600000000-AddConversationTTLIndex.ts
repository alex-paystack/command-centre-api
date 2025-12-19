import { MigrationInterface, QueryRunner } from 'typeorm';
import { MongoClient } from 'mongodb';

/**
 * Adds TTL indexes to conversations and messages to enforce retention.
 *
 * - conversations.expiresAt: expireAfterSeconds 0 (absolute expiry timestamp)
 * - messages.expiresAt: expireAfterSeconds 0 (aligned to conversation expiry)
 *
 * Down migration drops only the TTL indexes (collections remain).
 */
export class AddConversationTTLIndex1734600000000 implements MigrationInterface {
  name = 'AddConversationTTLIndex1734600000000';

  public async up(queryRunner: QueryRunner) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const mongoClient = (queryRunner.connection.driver as any).queryRunner.databaseConnection as MongoClient;
    const db = mongoClient.db();

    await db.collection('conversations').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection('conversations').createIndex({ lastActivityAt: 1 });
    await db.collection('messages').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  }

  public async down(queryRunner: QueryRunner) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const mongoClient = (queryRunner.connection.driver as any).queryRunner.databaseConnection as MongoClient;
    const db = mongoClient.db();

    await db
      .collection('conversations')
      .dropIndex('expiresAt_1')
      .catch(() => undefined);
    await db
      .collection('conversations')
      .dropIndex('lastActivityAt_1')
      .catch(() => undefined);
    await db
      .collection('messages')
      .dropIndex('expiresAt_1')
      .catch(() => undefined);
  }
}
