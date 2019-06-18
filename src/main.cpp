#include <napi.h>
#include <malloc.h>
#include <iostream>
#include "decompress.h"
#include "crc.h"

using namespace Napi;
using std::cout;

// # decompress()
Value decompress(CallbackInfo& info) {

	auto env = info.Env();
	try {
		auto buffer = info[0].As<Buffer<unsigned char>>();
		int size = info[1].As<Number>().Int32Value();
		auto data = (unsigned char*) buffer.Data();
		auto out = uncompress_data(data, &size);

		// Done.
		return Buffer<unsigned char>::New(env, out, size);

	} catch (...) {
		Error::New(env, "Error occurred while uncompressing").ThrowAsJavaScriptException();
		return Boolean::New(env, false);
	}

}

// # compress()
Value compress(CallbackInfo& info) {

	auto env = info.Env();
	try {
		auto buffer = info[0].As<Buffer<unsigned char>>();
		int size = info[1].As<Number>().Int32Value();
		auto data = (unsigned char*) buffer.Data();
		unsigned char* out = (unsigned char*)malloc(size);
		compress_data(data, &size, out);
		return Buffer<unsigned char>::New(env, out, size);
	} catch (...) {
		Error::New(env, "Error occurred while compressing").ThrowAsJavaScriptException();
		return Boolean::New(env, false);
	}

}

// # crc(CallbackInfo& info)
Value crc(CallbackInfo& info) {

	auto env = info.Env();
	try {
		auto buffer = info[0].As<Buffer<unsigned char>>();
		int size = info[1].As<Number>().Int32Value();
		auto data = (unsigned char*) buffer.Data();
		unsigned int crc = xcrc32(data, size);
		return Number::New(env, (double)crc);
	} catch (...) {
		Error::New(env, "Error occurred while crc").ThrowAsJavaScriptException();
		return Boolean::New(env, false);
	}

}

Object init(Env env, Object exports) {
	exports.Set("decompress", Function::New(env, decompress));
	exports.Set("compress", Function::New(env, compress));
	exports.Set("crc", Function::New(env, crc));
	return exports;
}

NODE_API_MODULE(qfs, init);