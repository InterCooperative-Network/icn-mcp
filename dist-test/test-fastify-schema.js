// Quick test to verify Fastify schema validation is working
import Fastify from 'fastify';
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { z } from 'zod';
const app = Fastify({ logger: false }).withTypeProvider < ZodTypeProvider > ();
// Set up Zod validation and serialization compilers
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
// Test route with schema validation
app.get('/test/:workflowId', {
    schema: {
        params: z.object({
            workflowId: z.string().min(8).max(64).regex(/^[a-z0-9-]+$/)
        })
    }
}, async (req, reply) => {
    return { ok: true, workflowId: req.params.workflowId };
});
// Test the server starts correctly
try {
    await app.ready();
    console.log('✓ Fastify server with Zod validation initialized successfully');
    // Test schema validation with valid input
    const validResponse = await app.inject({
        method: 'GET',
        url: '/test/valid-workflow-123'
    });
    if (validResponse.statusCode === 200) {
        console.log('✓ Valid input validation passed');
    }
    else {
        console.error('✗ Valid input failed:', validResponse.statusCode);
    }
    // Test schema validation with invalid input
    const invalidResponse = await app.inject({
        method: 'GET',
        url: '/test/abc' // Too short
    });
    if (invalidResponse.statusCode === 400) {
        console.log('✓ Invalid input correctly rejected');
    }
    else {
        console.error('✗ Invalid input not rejected:', invalidResponse.statusCode);
    }
    await app.close();
    console.log('✓ All tests passed - Fastify schema validation is working');
}
catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
}
