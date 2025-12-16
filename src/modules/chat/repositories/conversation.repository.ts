import { Injectable } from '@nestjs/common';
import { DataSource, MongoRepository } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { ChatMode, PageContextType } from 'src/common';

@Injectable()
export class ConversationRepository extends MongoRepository<Conversation> {
  constructor(private dataSource: DataSource) {
    super(Conversation, dataSource.createEntityManager());
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
}
