cmake_minimum_required(VERSION 3.15)
project(brainer-llama)

include_directories(${CMAKE_JS_INC})

set(CMAKE_POSITION_INDEPENDENT_CODE ON)

set(LLAMA_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)

if(APPLE)
  set(GGML_METAL ON CACHE BOOL "" FORCE)
  set(GGML_METAL_EMBED_LIBRARY ON CACHE BOOL "" FORCE)
endif()

add_subdirectory(llama.cpp)

file(GLOB_RECURSE ADDON_SOURCES "src/*.cpp")
add_library(${PROJECT_NAME} SHARED ${ADDON_SOURCES} ${CMAKE_JS_SRC})

target_include_directories(${PROJECT_NAME} PRIVATE
  ${CMAKE_SOURCE_DIR}/llama.cpp/include
  ${CMAKE_SOURCE_DIR}/llama.cpp/ggml/include
)

target_link_libraries(${PROJECT_NAME} PRIVATE
  llama
  ${CMAKE_JS_LIB}
)

execute_process(
  COMMAND node -p "require('node-addon-api').include"
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/..
  OUTPUT_VARIABLE NODE_ADDON_API_DIR
  OUTPUT_STRIP_TRAILING_WHITESPACE
)
string(REPLACE "\"" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})
target_include_directories(${PROJECT_NAME} PRIVATE ${NODE_ADDON_API_DIR})
target_compile_definitions(${PROJECT_NAME} PRIVATE NAPI_VERSION=8 NAPI_DISABLE_CPP_EXCEPTIONS)

set_target_properties(${PROJECT_NAME} PROPERTIES
  PREFIX "" SUFFIX ".node"
  CXX_STANDARD 17
)
