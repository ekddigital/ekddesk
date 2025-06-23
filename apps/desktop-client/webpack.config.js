const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

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
    ],
    devtool: 'source-map',
};
