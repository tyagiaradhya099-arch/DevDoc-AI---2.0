function AIChat({
  chatMessages,
  chatInput,
  setChatInput,
  handleSendMessage,
  isSendingMessage,
}) {
  return (
    <aside className="ai-panel">
      <h2>DevDoc AI</h2>
      <p>Ask questions about your codebase.</p>

      <div className="chat-container">
        {chatMessages.length === 0 ? (
          <div className="chat-empty-state">
            <p>💬</p>
            <h3>Understand your code</h3>
            <p>Ask a question to explore your codebase.</p>
          </div>
        ) : (
          <div className="chat-messages">
            {chatMessages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`chat-message ${message.role}-message`}
              >
                <strong>
                  {message.role === "user"
                    ? "You"
                    : message.role === "assistant"
                    ? "DevDoc"
                    : "Error"}
                </strong>

                <div className="chat-message-content">
                  {message.content}
                </div>

                {message.role === "assistant" &&
                  message.sources?.length > 0 && (
                    <div className="chat-sources">
                      <strong>Sources:</strong>

                      {message.sources.map((source, sourceIndex) => (
                        <div key={`${source.filePath}-${sourceIndex}`}>
                          📄 {source.filePath}
                          <small>
                            Lines {source.startLine}–{source.endLine}
                          </small>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            ))}

            {isSendingMessage && (
              <div className="chat-loading">
                DevDoc is thinking...
              </div>
            )}
          </div>
        )}

        <div className="chat-input-area">
          <textarea
            placeholder="Ask DevDoc anything..."
            rows={3}
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isSendingMessage}
          />

          <button
            type="button"
            onClick={handleSendMessage}
            disabled={!chatInput.trim() || isSendingMessage}
          >
            {isSendingMessage ? "..." : "↑"}
          </button>
        </div>
      </div>
    </aside>
  );
}

export default AIChat;