import { Injectable } from '@nestjs/common';
import { DataSource, MongoRepository } from 'typeorm';
import { Message } from '../entities/message.entity';

@Injectable()
export class MessageRepository extends MongoRepository<Message> {
  constructor(private dataSource: DataSource) {
    super(Message, dataSource.createEntityManager());
  }

  async findByConversationId(conversationId: string): Promise<Message[]> {
    return this.findBy({ conversationId });
  }

  async createMessage(data: Partial<Message>): Promise<Message> {
    const message = this.create(data);
    return this.save(message);
  }

  async createMessages(data: Partial<Message>[]): Promise<Message[]> {
    const messages = this.create(data);
    return this.save(messages);
  }

  async deleteAllByConversationId(conversationId: string): Promise<number> {
    const result = await this.deleteMany({ conversationId });
    return result.deletedCount ?? 0;
  }
}
