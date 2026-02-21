FROM reactnativecommunity/react-native-android:latest

ENV GRADLE_OPTS="-Xmx6g -XX:MaxMetaspaceSize=2g -XX:+HeapDumpOnOutOfMemoryError"
ENV NODE_ENV=production
ENV JAVA_OPTS="-Xmx6g -XX:MaxMetaspaceSize=2g"

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

RUN npx expo prebuild --platform android --clean

RUN sed -i 's/org\.gradle\.jvmargs=.*/org.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=2g/' android/gradle.properties
RUN echo 'org.gradle.parallel=false' >> android/gradle.properties
RUN echo 'org.gradle.workers.max=2' >> android/gradle.properties

WORKDIR /app/android
RUN ./gradlew assembleRelease

RUN mkdir -p /output
RUN cp app/build/outputs/apk/release/app-release.apk /output/
