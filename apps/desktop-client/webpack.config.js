const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const dotenv = require('dotenv');

// Load environment variables based on NODE_ENV
const env = process.env.NODE_ENV || 'development';
const envPath = path.resolve(__dirname, `.env.${env}`);
const envConfig = dotenv.config({ path: envPath });

// Also load .env.local if it exists (for local overrides)
const localEnvPath = path.resolve(__dirname, '.env.local');
dotenv.config({ path: localEnvPath });

module.exports = {
    mode: 'development',
    entry: './src/renderer.tsx',
    target: 'web',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'renderer.js',
        libraryTarget: 'umd',
        globalObject: 'this',
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {
            "events": false,
            "stream": false,
            "util": false,
            "buffer": false,
            "crypto": false,
            "fs": false,
            "path": false,
            "os": false
        }
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html',
        }),
        new webpack.DefinePlugin({
            // Inject environment variables into the renderer process
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
            'process.env.EKD_API_BASE_URL': JSON.stringify(process.env.EKD_API_BASE_URL),
            'process.env.EKD_SIGNALING_URL': JSON.stringify(process.env.EKD_SIGNALING_URL),
            'process.env.EKD_APP_NAME': JSON.stringify(process.env.EKD_APP_NAME),
            'process.env.EKD_APP_VERSION': JSON.stringify(process.env.EKD_APP_VERSION),
            'process.env.EKD_ENABLE_DEBUG_LOGS': JSON.stringify(process.env.EKD_ENABLE_DEBUG_LOGS),
            'process.env.EKD_ENABLE_AUTO_UPDATE': JSON.stringify(process.env.EKD_ENABLE_AUTO_UPDATE),
            'process.env.EKD_ENABLE_CRASH_REPORTING': JSON.stringify(process.env.EKD_ENABLE_CRASH_REPORTING),
            'process.env.EKD_CONNECTION_TIMEOUT': JSON.stringify(process.env.EKD_CONNECTION_TIMEOUT),
            'process.env.EKD_MAX_RETRY_ATTEMPTS': JSON.stringify(process.env.EKD_MAX_RETRY_ATTEMPTS),
            'process.env.EKD_ENABLE_HTTPS': JSON.stringify(process.env.EKD_ENABLE_HTTPS),
            'process.env.EKD_CERTIFICATE_VALIDATION': JSON.stringify(process.env.EKD_CERTIFICATE_VALIDATION),
        }),
    ],
    devtool: 'source-map',
};
