import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class SimpleVectorStore {
  constructor(storagePath) {
    this.storagePath = storagePath;
    this.data = [];
  }

  async load() {
    try {
      const content = await fs.readFile(this.storagePath, 'utf-8');
      this.data = JSON.parse(content);
    } catch {
      this.data = [];
    }
  }

  async save() {
    await fs.writeFile(this.storagePath, JSON.stringify(this.data, null, 2));
  }

  async upsert(fileData) {
    const index = this.data.findIndex(d => d.id === fileData.id);
    if (index >= 0) {
      this.data[index] = { ...this.data[index], ...fileData, last_updated: Date.now() };
    } else {
      this.data.push({ ...fileData, last_updated: Date.now() });
    }
    await this.save();
  }

  get(id) {
    return this.data.find(d => d.id === id);
  }

  calculateHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  getAll() {
    return this.data;
  }
}
