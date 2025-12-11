import { MigrationInterface, QueryRunner } from 'typeorm';
import { MongoClient } from 'mongodb';

/**
 * Creates conversations and messages collections for the chat module
 * with appropriate indexes for query performance.
 *
 * Collections:
 * - conversations: Stores conversation metadata (id, title, userId, createdAt)
 * - messages: Stores individual messages within conversations (id, conversationId, role, parts, createdAt)
 *
 * Indexes:
 * - conversations: id (unique), userId, createdAt
 * - messages: id (unique), conversationId, createdAt, compound (conversationId + createdAt)
 */
export class CreateChatCollections1734000000000 implements MigrationInterface {
  name = 'CreateChatCollections1734000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Access MongoDB native driver
    // Note: TypeORM's MongoDB support requires accessing the native driver directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const mongoClient = (queryRunner.connection.driver as any).queryRunner.databaseConnection as MongoClient;
    const db = mongoClient.db();

    // Create conversations collection
    await db.createCollection('conversations');

    // Create indexes for conversations collection
    await db.collection('conversations').createIndex({ id: 1 }, { unique: true });
    await db.collection('conversations').createIndex({ userId: 1 });
    await db.collection('conversations').createIndex({ createdAt: -1 });

    // Create messages collection
    await db.createCollection('messages');

    // Create indexes for messages collection
    await db.collection('messages').createIndex({ id: 1 }, { unique: true });
    await db.collection('messages').createIndex({ conversationId: 1 });
    await db.collection('messages').createIndex({ createdAt: 1 });

    // Create compound index for efficient message queries by conversation
    await db.collection('messages').createIndex({ conversationId: 1, createdAt: 1 });

    // eslint-disable-next-line no-console
    console.log('✅ Created conversations and messages collections with indexes');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Access MongoDB native driver
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const mongoClient = (queryRunner.connection.driver as any).queryRunner.databaseConnection as MongoClient;
    const db = mongoClient.db();

    // Drop collections (this will also drop all indexes)
    await db.collection('messages').drop();
    await db.collection('conversations').drop();

    // eslint-disable-next-line no-console
    console.log('✅ Dropped conversations and messages collections');
  }
}
