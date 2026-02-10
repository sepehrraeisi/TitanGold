import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

console.log('Initializing Zod with OpenAPI extension...');
extendZodWithOpenApi(z);
console.log('Zod initialized.');
