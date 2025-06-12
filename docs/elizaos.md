# ElizaOS Development Guidelines

## Core Architecture Rules

### **Rule #1: Always Use Custom Providers for Content Generation**

**✅ DO: Use Providers for:**

- Content generation and formatting
- Data fetching and processing
- Contextual responses
- Investment advice and recommendations
- Market data analysis
- Portfolio calculations

**❌ DON'T: Use Actions for:**

- Simple content responses
- Data presentation
- Text formatting
- Single-step operations

### **Why Providers > Actions**

1. **Reliability**: Direct integration with ElizaOS messaging system
2. **Performance**: No callback dependency chains that can fail
3. **Debugging**: Simpler error tracking and logging
4. **Bootstrap Independence**: Not affected by room context issues
5. **Future-Proof**: Less dependent on action system quirks

### **Technical Implementation Pattern**

```typescript
// ✅ GOOD: Custom Provider Pattern
const myCustomProvider: Provider = {
  name: 'MY_FEATURE',
  description: 'Handles specific feature functionality',

  get: async (runtime, message, state): Promise<ProviderResult> => {
    // Validation
    if (!shouldTrigger(message.content.text)) {
      return { text: '', values: {}, data: {} }
    }

    // Processing
    const result = await processRequest(message)

    // Formatted Response
    return {
      text: formatResponse(result),
      values: {
        /* structured data */
      },
      data: {
        /* additional context */
      },
    }
  },
}

// ❌ AVOID: Action Pattern for Simple Content
const myAction: Action = {
  // Actions should only be used for complex workflows
  // that require multiple steps or external side effects
}
```

## Development Best Practices

### **Provider Development Guidelines**

1. **Single Responsibility**: One provider per feature/capability
2. **Clear Validation**: Check message content before processing
3. **Graceful Fallbacks**: Return empty results for non-matching queries
4. **Structured Output**: Use consistent text formatting
5. **Error Handling**: Log errors but don't throw exceptions
6. **Performance**: Cache expensive operations when possible

### **Message Processing Flow**

```
User Input → Provider Validation → Data Processing → Response Formatting → User Output
```

### **Response Formatting Standards**

```typescript
// Use consistent markdown formatting
const formattedResponse =
  `# Main Title\n\n` +
  `*Subtitle or context*\n\n` +
  `## Section Header\n` +
  `**Bold points**\n` +
  `• Bullet points\n\n` +
  `---\n\n` +
  `## Next Section\n` +
  `Content here...\n\n` +
  `*Footer information*`
```

### **Provider Registration**

```typescript
// Always register providers in plugin export
export default {
  name: 'my-plugin',
  providers: [
    myCustomProvider,
    anotherProvider,
    // ... all providers
  ],
  actions: [
    // Only complex multi-step workflows
  ],
}
```

## Testing Guidelines

### **Provider Testing Pattern**

```typescript
describe('Custom Provider', () => {
  it('should trigger on valid input', async () => {
    const result = await provider.get(runtime, validMessage, state)
    expect(result.text).toBeTruthy()
    expect(result.values).toBeDefined()
  })

  it('should not trigger on invalid input', async () => {
    const result = await provider.get(runtime, invalidMessage, state)
    expect(result.text).toBe('')
  })
})
```

## Debugging & Troubleshooting

### **Common Issues**

1. **Provider Not Triggering**

   - Check validation logic
   - Verify message content parsing
   - Add debug logging

2. **Response Not Showing**

   - Ensure non-empty text return
   - Check for async/await issues
   - Verify provider registration

3. **Performance Issues**
   - Implement caching for expensive operations
   - Optimize data fetching
   - Use parallel processing where possible

### **Debug Logging Pattern**

```typescript
logger.info('🚀 PROVIDER TRIGGERED - Processing request')
logger.info(`📊 Data fetched: ${data.length} items`)
logger.info('✅ PROVIDER SUCCESS - Response generated')
```

## Production Considerations

### **Scalability**

- Use caching for expensive operations
- Implement rate limiting for external APIs
- Handle errors gracefully without breaking the agent

### **Monitoring**

- Log all provider executions
- Track response times
- Monitor error rates

### **Security**

- Validate all user inputs
- Sanitize data before processing
- Never expose sensitive information in responses

## Migration from Actions to Providers

### **Step-by-Step Process**

1. **Identify Action Candidates**: Simple content generation actions
2. **Extract Core Logic**: Business logic from action handlers
3. **Create Provider**: Implement provider pattern
4. **Update Validation**: Move validation to provider.get()
5. **Test Thoroughly**: Ensure same functionality
6. **Remove Action**: Clean up old action code

### **Example Migration**

```typescript
// BEFORE: Action Handler
const myAction: Action = {
  handler: async (runtime, message, state, options, callback) => {
    const result = await processData(message)
    await callback({ text: formatResult(result) })
  },
}

// AFTER: Custom Provider
const myProvider: Provider = {
  get: async (runtime, message, state) => {
    if (!shouldProcess(message)) return { text: '', values: {}, data: {} }

    const result = await processData(message)
    return {
      text: formatResult(result),
      values: { processedData: result },
      data: {},
    }
  },
}
```

## Summary

**Always prefer Custom Providers over Actions** for content generation, data presentation, and user-facing responses. Actions should be reserved for complex workflows that require multiple steps, external side effects, or sophisticated state management.

This approach ensures:

- **Reliability**: Fewer points of failure
- **Maintainability**: Simpler debugging and testing
- **Performance**: Direct response path
- **Future-Proofing**: Less dependent on action system evolution
