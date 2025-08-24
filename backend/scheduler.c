/* Minimal scheduler daemon that writes frontend JSON files for demo
 * Compile: gcc scheduler.c -o scheduler -lm
 * Run from project root: ./backend/scheduler
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <limits.h>

#define MAX_LINE 1024
#define MAX_TASKS 1024

typedef struct Task {
    int id;
    char username[64];
    char title[128];
    char desc[256];
    char tag[32];
    int difficulty;
    int priority;
    long start_epoch;
    long end_epoch;
    int recur_minutes;
    int completed;
} Task;

Task tasks[MAX_TASKS];
int task_count = 0;
char data_path[512] = "../frontend/data";
int poll_interval = 10;

void ensure_dir(const char *p) {
    char cmd[1024];
    snprintf(cmd, sizeof(cmd), "mkdir -p %s", p);
    system(cmd);
}

int parse_tasks_file(const char *fname) {
    FILE *f = fopen(fname, "r");
    if (!f) return 0;
    char line[MAX_LINE];
    task_count = 0;
    while (fgets(line, sizeof(line), f)) {
        if (line[0]=='#' || strlen(line)<3) continue;
        Task t; memset(&t,0,sizeof(t));
        char *p = strdup(line);
        char *tok = strtok(p, "|\n");
        int idx=0;
        while (tok) {
            switch(idx) {
                case 0: t.id = atoi(tok); break;
                case 1: strncpy(t.username, tok, sizeof(t.username)-1); break;
                case 2: strncpy(t.title, tok, sizeof(t.title)-1); break;
                case 3: strncpy(t.desc, tok, sizeof(t.desc)-1); break;
                case 4: strncpy(t.tag, tok, sizeof(t.tag)-1); break;
                case 5: t.difficulty = atoi(tok); break;
                case 6: t.priority = atoi(tok); break;
                case 7: t.start_epoch = atol(tok); break;
                case 8: t.end_epoch = atol(tok); break;
                case 9: t.recur_minutes = atoi(tok); break;
            }
            idx++; tok = strtok(NULL, "|\n");
        }
        free(p);
        tasks[task_count++] = t;
        if (task_count>=MAX_TASKS) break;
    }
    fclose(f);
    return task_count;
}

double compute_productivity(Task *arr, int n) {
    if (n==0) return 0.0;
    double score=0, total=0;
    for (int i=0;i<n;i++) {
        total += arr[i].difficulty;
        if (arr[i].completed) score += arr[i].difficulty;
    }
    return total? (score/total)*10.0 : 0.0;
}

void write_tasks_json(const char *out_dir, Task *arr, int n) {
    char fname[1024];
    snprintf(fname,sizeof(fname),"%s/tasks.json", out_dir);
    FILE *f = fopen(fname,"w");
    if (!f) return;
    fprintf(f,"{\n  \"tasks\": [\n");
    for (int i=0;i<n;i++) {
        fprintf(f,"    {\"id\":%d,\"username\":\"%s\",\"title\":\"%s\",\"desc\":\"%s\",\"tag\":\"%s\",\"difficulty\":%d,\"priority\":%d,\"start\":%ld,\"end\":%ld,\"completed\":%d}%s\n",
            arr[i].id, arr[i].username, arr[i].title, arr[i].desc, arr[i].tag, arr[i].difficulty, arr[i].priority, arr[i].start_epoch, arr[i].end_epoch, arr[i].completed, (i==n-1)?"":" ,");
    }
    double prod = compute_productivity(arr,n);
    // pressure: fraction of tasks with near deadlines
    double pressure = 0.0; int cnt=0;
    long now = time(NULL);
    for (int i=0;i<n;i++) if (arr[i].end_epoch>0) {
        double hours_left = (double)(arr[i].end_epoch - now)/3600.0; if (hours_left<0) hours_left=0;
        pressure += 1.0 - fmin(1.0, hours_left/(24.0*7.0)); cnt++;
    }
    if (cnt) pressure = pressure / cnt; else pressure = 0.0;
    fprintf(f,"  ],\n  \"meta\": {\"productivity\": %.2f, \"pressure\": %.3f}\n}\n", prod, pressure);
    fclose(f);
}

void write_heatmap(const char *out_dir, Task *arr, int n) {
    int heat[24]; for (int i=0;i<24;i++) heat[i]=0;
    time_t now = time(NULL); struct tm tmnow = *localtime(&now);
    for (int i=0;i<n;i++) if (arr[i].end_epoch>0) {
        struct tm t = *localtime(&arr[i].end_epoch);
        if (t.tm_mday==tmnow.tm_mday && t.tm_mon==tmnow.tm_mon && t.tm_year==tmnow.tm_year) heat[t.tm_hour]++;
    }
    char fname[1024]; snprintf(fname,sizeof(fname),"%s/heatmap.json", out_dir);
    FILE *f = fopen(fname,"w"); if (!f) return;
    fprintf(f,"{\"hours\":[");
    for (int i=0;i<24;i++) fprintf(f,"%d%s", heat[i], (i==23)?"":",");
    fprintf(f,"]}\n"); fclose(f);
}

void write_notifications(const char *out_dir, Task *arr, int n, time_t now) {
    char fname[1024]; snprintf(fname,sizeof(fname),"%s/notifications.json", out_dir);
    FILE *f = fopen(fname,"w"); if (!f) return;
    fprintf(f,"{\n  \"notifications\": [\n");
    int wrote=0;
    for (int i=0;i<n;i++) {
        if (arr[i].end_epoch>0 && arr[i].end_epoch - now <= poll_interval && arr[i].end_epoch - now >= 0) {
            if (wrote) fprintf(f,",\n");
            fprintf(f,"    {\"id\":%d,\"title\":\"%s\",\"desc\":\"%s\",\"username\":\"%s\"}", arr[i].id, arr[i].title, arr[i].desc, arr[i].username);
            wrote++;
        }
    }
    fprintf(f,"\n  ]\n}\n");
    fclose(f);
}

int main() {
    ensure_dir(data_path);
    printf("Scheduler demo starting. Writing to %s every %d seconds\n", data_path, poll_interval);
    while (1) {
        parse_tasks_file("backend/tasks_example.txt");
        Task copy[MAX_TASKS]; for (int i=0;i<task_count;i++) copy[i]=tasks[i];
        write_tasks_json(data_path, copy, task_count);
        write_heatmap(data_path, copy, task_count);
        time_t now = time(NULL);
        write_notifications(data_path, copy, task_count, now);
        sleep(poll_interval);
    }
    return 0;
}
