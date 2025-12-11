import { Injectable } from '@nestjs/common';
import { DataSource, MongoRepository } from 'typeorm';
import { Message } from '../entities/message.entity';

@Injectable()
export class MessageRepository extends MongoRepository<Message> {
  constructor(private dataSource: DataSource) {
    super(Message, dataSource.createEntityManager());
  }

  async findByChatId(chatId: string): Promise<Message[]> {
    return this.findBy({ chatId });
  }

  async createMessage(data: Partial<Message>): Promise<Message> {
    const message = this.create(data);
    return this.save(message);
  }

  async deleteAllByChatId(chatId: string): Promise<number> {
    const result = await this.deleteMany({ chatId });
    return result.deletedCount ?? 0;
  }
}
