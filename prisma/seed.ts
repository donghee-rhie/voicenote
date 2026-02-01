import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create default admin user
  const passwordHash = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@voicenote.local' },
    update: {},
    create: {
      email: 'admin@voicenote.local',
      name: '관리자',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      language: 'ko',
    },
  });
  console.log('Created admin user:', adminUser.email);

  // Create default system settings
  const systemSettings = [
    {
      key: 'app_name',
      value: 'VoiceNote',
      description: 'Application name',
      type: 'string',
    },
    {
      key: 'default_language',
      value: 'ko-KR',
      description: 'Default language for speech recognition',
      type: 'string',
    },
    {
      key: 'max_recording_duration',
      value: '3600000',
      description: 'Maximum recording duration in milliseconds (1 hour)',
      type: 'number',
    },
  ];

  for (const setting of systemSettings) {
    const created = await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
    console.log('Created system setting:', created.key);
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
