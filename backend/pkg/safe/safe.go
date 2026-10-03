package safe

import (
	"fmt"
	"runtime/debug"

	"mertervitrini/backend/pkg/logger"
)

// Go runs the given function in a new goroutine protected by panic recovery.
// If the goroutine panics, the panic is caught, logged to the daily error file with full stack trace,
// preventing process termination.
func Go(name string, fn func()) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				stack := debug.Stack()
				logger.LogPanic(fmt.Sprintf("Goroutine [%s]", name), r, stack)
			}
		}()
		fn()
	}()
}

// Call executes a function synchronously, converting any panic into an error.
func Call(fn func() error) (err error) {
	defer func() {
		if r := recover(); r != nil {
			stack := debug.Stack()
			logger.LogPanic("Synchronous Execution", r, stack)
			err = fmt.Errorf("panic recovered: %v", r)
		}
	}()
	return fn()
}
