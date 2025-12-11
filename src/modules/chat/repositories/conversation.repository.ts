import { Injectable } from '@nestjs/common';
import { DataSource, MongoRepository } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';

@Injectable()
export class ConversationRepository extends MongoRepository<Conversation> {
  constructor(private dataSource: DataSource) {
    super(Conversation, dataSource.createEntityManager());
  }

  async findById(id: string) {
    return this.findOneBy({ id });
  }

  async findByUserId(userId: string) {
    return this.findBy({ userId });
  }

  async createConversation(data: Partial<Conversation>) {
    const conversation = this.create(data);
    return this.save(conversation);
  }

  async deleteById(id: string) {
    const result = await this.deleteMany({ id });
    return (result.deletedCount ?? 0) > 0;
  }

  async deleteAllByUserId(userId: string) {
    const result = await this.deleteMany({ userId });
    return result.deletedCount ?? 0;
  }
}
