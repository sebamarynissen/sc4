{
	"targets": [{
		"target_name": "lib-cpp",
		"cflags!": ["-fno-exceptions"],
		"cflags_cc!": ["-fno-exceptions"],
		"sources": [
			"src/main.cpp",
			"src/decompress.cpp",
			"src/crc.cpp"
		],
		"include_dirs": [
			"<!@(node -p \"require('node-addon-api').include\")",
			"src"
		],
		"libraries": [],
		"dependencies": [
			"<!(node -p \"require('node-addon-api').gyp\")"
		],
		"defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"]
	}]
}