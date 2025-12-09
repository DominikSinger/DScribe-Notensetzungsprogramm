// Jest Setup
global.console = {
    ...console,
    debug: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Mock Electron API
global.electron = {
    app: {
        getVersion: jest.fn(() => '13.0.0'),
        getPath: jest.fn(() => '/tmp')
    },
    dialog: {
        showOpenDialog: jest.fn(() => ({ filePaths: [] })),
        showSaveDialog: jest.fn(() => ({ filePath: null }))
    },
    ipcMain: {
        on: jest.fn(),
        handle: jest.fn()
    }
};

// Mock logger
global.logger = {
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};
