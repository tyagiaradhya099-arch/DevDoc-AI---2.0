function AIChat({
  chatMessages,
  chatInput,
  setChatInput,
  handleSendMessage,
  isSendingMessage,
}) {
  return (
    <aside className="ai-panel">
       <div className="ai-panel-header">
            <h2>DevDoc AI</h2>
       </div>

      <div className="chat-container">
        {chatMessages.length === 0 ? (
          <div className="chat-empty-state">
            <div className="chat-empty-icon">
               <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
               </svg>
            </div>
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