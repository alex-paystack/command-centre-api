import { Injectable } from '@nestjs/common';
import { DataSource, MongoRepository } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { ChatMode, PageContextType } from 'src/common';

@Injectable()
export class ConversationRepository extends MongoRepository<Conversation> {
  constructor(private dataSource: DataSource) {
    super(Conversation, dataSource.createEntityManager());
  }

  private static defaultExpiresAt() {
    const now = new Date();
    const threeDaysInMilliseconds = 3 * 24 * 60 * 60 * 1000;
    return new Date(now.getTime() + threeDaysInMilliseconds);
  }

  async findById(id: string) {
    return this.findOneBy({ id });
  }

  async findByIdAndUserId(id: string, userId: string) {
    return this.findOneBy({ id, userId });
  }

  async findByUserId(userId: string) {
    return this.find({
      where: { userId },
      order: { createdAt: 'desc' },
    });
  }

  async findByUserIdAndMode(userId: string, mode: ChatMode) {
    return this.find({
      where: { userId, mode },
      order: { createdAt: 'desc' },
    });
  }

  async findByUserIdAndContextType(userId: string, contextType: PageContextType) {
    // Use dot-notation so Mongo matches embedded objects that include other keys (e.g. resourceId)
    return this.find({
      where: { userId, 'pageContext.type': contextType },
      order: { createdAt: 'desc' },
    });
  }

  async findByUserIdAndModeAndContextType(userId: string, mode: ChatMode, contextType: PageContextType) {
    return this.find({
      where: { userId, mode, 'pageContext.type': contextType },
      order: { createdAt: 'desc' },
    });
  }

  async createConversation(data: Partial<Conversation>) {
    const conversation = this.create({
      ...data,
      summaryCount: data.summaryCount ?? 0,
      isClosed: data.isClosed ?? false,
      lastActivityAt: data.lastActivityAt ?? new Date(),
      expiresAt: data.expiresAt ?? ConversationRepository.defaultExpiresAt(),
    });
    return this.save(conversation);
  }

  async deleteById(id: string) {
    const result = await this.deleteMany({ id });
    return (result.deletedCount ?? 0) > 0;
  }

  async deleteByIdForUser(id: string, userId: string) {
    const result = await this.deleteMany({ id, userId });
    return (result.deletedCount ?? 0) > 0;
  }

  async deleteAllByUserId(userId: string) {
    const result = await this.deleteMany({ userId });
    return result.deletedCount ?? 0;
  }

  async refreshExpiryWindow(conversationId: string, retentionDays: number) {
    const now = new Date();
    const retentionDaysInMilliseconds = retentionDays * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(now.getTime() + retentionDaysInMilliseconds);

    await this.updateOne(
      { id: conversationId },
      {
        $set: {
          lastActivityAt: now,
          expiresAt,
        },
      },
    );
  }
}
