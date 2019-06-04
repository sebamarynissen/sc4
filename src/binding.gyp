{
	"targets": [{
		"target_name": "qfs",
		"cflags!": ["-fno-exceptions"],
		"cflags_cc!": ["-fno-exceptions"],
		"sources": [
			"main.cpp",
			"decompress.cpp"
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