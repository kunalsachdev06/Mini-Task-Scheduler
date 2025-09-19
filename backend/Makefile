# Makefile for Task Scheduler Backend

CC = gcc
CFLAGS = -Wall -Wextra -std=c99 -pthread -D_POSIX_C_SOURCE=200809L
LIBS = -lsqlite3 -lcjson -lssl -lcrypto -luuid -lpthread

# Source files
SOURCES = server.c auth.c utils.c
OBJECTS = $(SOURCES:.c=.o)
TARGET = scheduler_server

# Build target
all: $(TARGET)

$(TARGET): $(OBJECTS)
	$(CC) $(OBJECTS) -o $(TARGET) $(LIBS)

# Compile object files
%.o: %.c server.h
	$(CC) $(CFLAGS) -c $< -o $@

# Clean build files
clean:
	rm -f $(OBJECTS) $(TARGET) scheduler.db

# Install dependencies (Ubuntu/Debian)
install-deps:
	sudo apt-get update
	sudo apt-get install -y build-essential libsqlite3-dev libcjson-dev libssl-dev uuid-dev

# Install dependencies (Windows with MinGW)
install-deps-windows:
	@echo "Please install MSYS2 and run:"
	@echo "pacman -S mingw-w64-x86_64-gcc mingw-w64-x86_64-sqlite3 mingw-w64-x86_64-cjson mingw-w64-x86_64-openssl mingw-w64-x86_64-libuuid"

# Run the server
run: $(TARGET)
	./$(TARGET)

# Debug build
debug: CFLAGS += -g -DDEBUG
debug: $(TARGET)

# Create database and test data
setup-db: $(TARGET)
	./$(TARGET) --init-db

.PHONY: all clean install-deps install-deps-windows run debug setup-db