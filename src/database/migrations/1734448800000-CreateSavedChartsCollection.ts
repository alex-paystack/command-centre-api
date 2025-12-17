import { MigrationInterface, QueryRunner } from 'typeorm';
import { MongoClient } from 'mongodb';

/**
 * Creates saved_charts collection for storing user-saved chart configurations
 * that can be retrieved and regenerated with fresh data.
 *
 * Charts are standalone resources, not tied to conversations. An optional
 * createdFromConversationId field tracks the source conversation for reference only.
 *
 * Collections:
 * - saved_charts: Stores chart configurations (id, userId, name, description,
 *   createdFromConversationId, resourceType, aggregationType, filters, timestamps)
 *
 * Indexes:
 * - id (unique): For direct chart lookup
 * - userId: For listing user's charts
 * - compound (userId + createdAt): For efficient user queries sorted by creation date
 * - createdFromConversationId: Optional reference to source conversation
 */
export class CreateSavedChartsCollection1734448800000 implements MigrationInterface {
  name = 'CreateSavedChartsCollection1734448800000';

  public async up(queryRunner: QueryRunner) {
    // Access MongoDB native driver
    // Note: TypeORM's MongoDB support requires accessing the native driver directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const mongoClient = (queryRunner.connection.driver as any).queryRunner.databaseConnection as MongoClient;
    const db = mongoClient.db();

    // Create saved_charts collection
    await db.createCollection('saved_charts');

    // Create indexes for saved_charts collection
    await db.collection('saved_charts').createIndex({ id: 1 }, { unique: true });
    await db.collection('saved_charts').createIndex({ userId: 1 });
    await db.collection('saved_charts').createIndex({ userId: 1, createdAt: -1 });
    await db.collection('saved_charts').createIndex({ createdFromConversationId: 1 }, { sparse: true });
    await db.collection('saved_charts').createIndex({ createdAt: -1 });

    // eslint-disable-next-line no-console
    console.log('✅ Created saved_charts collection with indexes');
  }

  public async down(queryRunner: QueryRunner) {
    // Access MongoDB native driver
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const mongoClient = (queryRunner.connection.driver as any).queryRunner.databaseConnection as MongoClient;
    const db = mongoClient.db();

    // Drop collection (this will also drop all indexes)
    await db.collection('saved_charts').drop();

    // eslint-disable-next-line no-console
    console.log('✅ Dropped saved_charts collection');
  }
}
